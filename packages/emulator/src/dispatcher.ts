type AllSubType<T> = T extends unknown ? T[keyof T] : never
export type MsgKeyOf<T extends { msg: unknown }> = AllSubType<Pick<T, 'msg'>>
export type GetMsg<T extends { msg: unknown }, M extends MsgKeyOf<T>> = Extract<
  T,
  { msg: M }
>

export const DispatchThis: unique symbol = Symbol()

export type DispatchEndpoint<
  Keys extends string,
  Msg extends { msg: Keys }
> = Partial<{
  [key in Keys]: (msg: Extract<Msg, { msg: key }>) => Promise<void>
}>

export class DispatchTranslator<
  Keys extends string,
  Msg extends { msg: Keys }
> {
  $endpoints: DispatchEndpoint<Keys, Msg>[]

  $broadcast: (msg: Msg) => DispatchTranslator<Keys, Msg>[]

  constructor(broadcast: (msg: Msg) => DispatchTranslator<Keys, Msg>[]) {
    this.$endpoints = []
    this.$broadcast = broadcast
  }

  $on(obj: DispatchEndpoint<Keys, Msg>): DispatchEndpoint<Keys, Msg> {
    this.$endpoints.push(obj)
    return obj
  }

  $off(obj: DispatchEndpoint<Keys, Msg>) {
    this.$endpoints = this.$endpoints.filter(e => e === obj)
  }

  async $emit(msg: Msg) {
    for (const e of this.$endpoints) {
      const f = e[msg.msg]
      if (!f) {
        continue
      }
      await f(msg as Extract<Msg, { msg: Keys }>)
    }
    const child = this.$broadcast(msg)
    for (const c of child) {
      await c.$emit(msg)
    }
  }
}
