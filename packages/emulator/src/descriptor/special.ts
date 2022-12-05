import { CardDescriptorTable } from '../types'
import { autoBind, fake } from '../utils'

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
}

export { data }
