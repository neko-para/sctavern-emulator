export interface FuncBase {
  (p: any): Promise<void>
}

export class Emitter<Msg extends Record<string, object>> {
  tran: string
  child: (Emitter<Msg> | null)[]
  func: {
    [msg in string & keyof Msg]?: FuncBase[]
  }
  rec: [string & keyof Msg, FuncBase][]

  constructor(tran: string, child: (Emitter<Msg> | null)[]) {
    this.tran = tran
    this.child = child
    this.func = {}
    this.rec = []
  }

  begin() {
    this.rec = []
  }

  end() {
    const r = this.rec
    return () => {
      for (const [m, f] of r) {
        this.off(m, f)
      }
    }
  }

  on<M extends string & keyof Msg>(msg: M, func: (p: Msg[M]) => Promise<void>) {
    const ft = this.func[msg] || []
    ft.push(func)
    this.func[msg] = ft
    this.rec.push([msg, func])
  }

  off<M extends string & keyof Msg>(
    msg: M,
    func: (p: Msg[M]) => Promise<void>
  ) {
    this.func[msg] = this.func[msg]?.filter(f => f !== func) || []
  }

  private getTran(param: any) {
    const sub = param[this.tran] as number | undefined
    if (sub) {
      return this.child[sub] || null
    } else {
      return null
    }
  }

  async emit<M extends string & keyof Msg>(msg: M, param: Msg[M]) {
    for (const f of this.func[msg] || []) {
      await f(param)
    }
    const down = this.getTran(param)
    if (down) {
      await down.emit(msg, param)
    } else {
      for (const c of this.child) {
        if (c) {
          await c.emit(msg, param)
        }
      }
    }
  }
}
