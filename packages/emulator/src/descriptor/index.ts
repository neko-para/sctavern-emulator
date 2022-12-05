import { data as TD } from './terran'
import { data as ZD } from './zerg'
import { data as PD } from './protoss'
import { data as ND } from './neutural'
import { data as SD } from './special'

export const Descriptors = {
  ...TD,
  ...ZD,
  ...PD,
  ...ND,
  ...SD,
}
