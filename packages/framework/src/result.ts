type tPlainOk<T> = {
  ok: T
}

type tPlainErr<E> = {
  err: E
}

export type tPlainResult<T, E> = tPlainOk<T> | tPlainErr<E>

export type tOk<T> = {
  ok: T
  check: true

  unwrap(): T
  match<RT, RE>(o: (ok: T) => RT, e: (err: never) => RE): RT | RE
  plain(): { ok: T }
}

export type tErr<E> = {
  err: E
  check: false

  unwrap(): never
  match<RT, RE>(o: (ok: never) => RT, e: (err: E) => RE): RT | RE
  plain(): { err: E }
}

export type tResult<T, E> = tOk<T> | tErr<E>

export function pOk<T>(v: T): tPlainOk<T> {
  return {
    ok: v
  }
}

export function pErr<E>(v: E): tPlainErr<E> {
  return {
    err: v
  }
}

export function Ok<T>(v: T): tOk<T> {
  return {
    ok: v,
    check: true,

    unwrap() {
      return this.ok
    },
    match(o) {
      return o(this.ok)
    },
    plain() {
      return {
        ok: this.ok
      }
    }
  }
}

export function Err<E>(v: E): tErr<E> {
  return {
    err: v,
    check: false,

    unwrap() {
      throw this.err
    },
    match(o, e) {
      return e(this.err)
    },
    plain() {
      return {
        err: this.err
      }
    }
  }
}

export function Result<T, E>(v: { ok: T } | { err: E }): tResult<T, E> {
  if ('ok' in v) {
    return Ok(v.ok)
  } else {
    return Err(v.err)
  }
}
