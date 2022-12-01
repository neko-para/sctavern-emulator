import { data as TD } from './terran.js'
import { data as ZD } from './zerg.js'
import { data as PD } from './protoss.js'
import { data as ND } from './neutural.js'

export const Descriptors = {
  ...TD,
  ...ZD,
  ...PD,
  ...ND,
}
