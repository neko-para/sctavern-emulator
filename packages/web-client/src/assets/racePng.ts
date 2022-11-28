import TPNG from '@/assets/terran.png'
import PPNG from '@/assets/protoss.png'
import ZPNG from '@/assets/zerg.png'
import NPNG from '@/assets/random.png'
import type { Race } from '@sctavern-emulator/data/types'

export const racepng: Record<Race, string> = {
  T: TPNG,
  P: PPNG,
  Z: ZPNG,
  N: NPNG,
  G: '',
}
