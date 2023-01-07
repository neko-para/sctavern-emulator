import { v4 as uuidv4 } from 'uuid'
import { reactive } from '@vue/reactivity'
import type {
  IWebSocketClientFactory,
  IWebSocketServerFactory,
} from './websock'
import { ClientSymbol, WsRpcClient, WsRpcServer, type RpcNotifier } from './rpc'
import { Err, Ok, type tResult } from './result'
import { RemoteServer } from './slave'
import { Md5 } from './utils'
import { Signal } from './signal'

export const enum GroupError {
  StateNotMatch = 'State is not as expected',
  UserUsed = 'User name already used',
  PasswordError = 'User or Password is not correct',
  SessionInvalid = 'Session is invalid',
  UserNotExist = 'User id is not exists',
  GroupNotExist = 'Group id is not exists',
  AlreadyInGroup = 'User is already in a group',
  NotInGroup = 'User is not in a group',
  GroupFull = 'Group is already full',
  SwitchedNotInGroup = 'Switched user is not in the group',
  UserNotOwner = 'User is not the owner of the group',
  PlayerNotEnough = 'Players are not enough',
}

export interface GroupGameConfig {
  min_players: number
  max_players: number
}

type SessionID = string
type UserID = string
type GroupID = string
type GameID = string

export type GroupRpcDefinition<C extends GroupGameConfig> = {
  service: {
    register: {
      request: {
        name: string
        pswdHash: string
      }
      respond: {
        session: SessionID
        id: UserID
        name: string
      }
      error: GroupError.UserUsed
    }
    login: {
      request: {
        name: string
        pswdHash: string
      }
      respond: {
        session: SessionID
        id: UserID
        name: string
        ingroup: boolean
      }
      error: GroupError.PasswordError
    }
    login_session: {
      request: {
        session: SessionID
      }
      respond: {
        id: UserID
        name: string
        ingroup: boolean
      }
      error: GroupError.SessionInvalid
    }
    query_user: {
      request: {
        session: SessionID
        ids: UserID[]
      }
      respond: ({
        id: UserID
        name: string
        current: GroupID | null
      } | null)[]
      error: GroupError.SessionInvalid
    }
    new_group: {
      request: {
        session: SessionID
      }
      respond: GroupID
      error: GroupError.SessionInvalid | GroupError.AlreadyInGroup
    }
    list_group: {
      request: {
        session: SessionID
      }
      respond: {
        name: string
        id: GroupID
      }[]
      error: GroupError.SessionInvalid
    }
    query_group: {
      request: {
        session: SessionID
        id: GroupID
      }
      respond: {
        id: GroupID
        name: string
        owner: UserID
        player: UserID[]
        config: C
        playerNames: string[]
      }
      error: GroupError.SessionInvalid | GroupError.GroupNotExist
    }
    enter_group: {
      request: {
        session: SessionID
        id: GroupID
      }
      respond: true
      error:
        | GroupError.SessionInvalid
        | GroupError.GroupNotExist
        | GroupError.AlreadyInGroup
        | GroupError.GroupFull
    }
    leave_group: {
      request: {
        session: SessionID
      }
      respond: true
      error: GroupError.SessionInvalid | GroupError.NotInGroup
    }
    start_game: {
      request: {
        session: SessionID
      }
      respond: true
      error:
        | GroupError.SessionInvalid
        | GroupError.NotInGroup
        | GroupError.UserNotOwner
        | GroupError.PlayerNotEnough
    }
  }
  notify: {
    group_list_updated: {
      session: SessionID
    }
    current_group_updated: {
      session: SessionID
      group: GroupID
    }
    current_group_breaked: {
      session: SessionID
    }
    game_started: {
      game: GameID
      port: number
      pos: number
      id: UserID
      config: C
    }
  }
}

interface UserData<T> {
  session: SessionID | null
  name: string
  pswd: string
  extra: T
}

interface SessionData<T> {
  user: UserID
  extra: T
}

class UserManager<UT, ST = object> {
  user: Record<UserID, UserData<UT>>
  fromName: Record<string, UserID>
  session: Record<SessionID, SessionData<ST>>

  constructor() {
    this.user = {}
    this.fromName = {}
    this.session = {}
  }

  invalid(ss: SessionID) {
    if (ss in this.session) {
      if (this.user[this.session[ss].user].session === ss) {
        this.user[this.session[ss].user].session = null
      }
      delete this.session[ss]
    }
  }

  register(name: string, pswd: string, user_extra: UT, session_extra: ST) {
    if (name in this.fromName) {
      return Err<GroupError.UserUsed>(GroupError.UserUsed)
    }
    const id = uuidv4()
    const ss = uuidv4()
    this.user[id] = {
      session: ss,
      name,
      pswd,
      extra: user_extra,
    }
    this.fromName[name] = id
    this.session[ss] = {
      user: id,
      extra: session_extra,
    }
    return Ok({ id, ss })
  }

  login(name: string, pswd: string, extra: ST) {
    if (!(name in this.fromName)) {
      return Err<GroupError.PasswordError>(GroupError.PasswordError)
    }
    const id = this.fromName[name]
    if (this.user[id].pswd !== pswd) {
      return Err<GroupError.PasswordError>(GroupError.PasswordError)
    }
    if (this.user[id].session) {
      this.invalid(this.user[id].session as string)
    }
    const ss = uuidv4()
    this.user[id].session = ss
    this.session[ss] = {
      user: id,
      extra,
    }
    return Ok({ id, ss })
  }

  query(id: UserID) {
    if (id in this.user) {
      const ud = this.user[id]
      return Ok({
        user: {
          ...ud,
          id,
        },
        session: ud.session
          ? {
              ...this.session[ud.session],
              id: ud.session,
            }
          : null,
      })
    } else {
      return Err<GroupError.UserNotExist>(GroupError.UserNotExist)
    }
  }

  test(ss: SessionID) {
    if (ss in this.session) {
      return Ok({
        user: {
          ...this.user[this.session[ss].user],
          id: this.session[ss].user,
        },
        session: {
          ...this.session[ss],
          id: ss,
        },
      })
    } else {
      return Err<GroupError.SessionInvalid>(GroupError.SessionInvalid)
    }
  }
}

export class GroupServer<C extends GroupGameConfig, InputMessage> {
  server: WsRpcServer<GroupRpcDefinition<C>>
  gserver: RemoteServer<InputMessage>

  user: UserManager<
    {
      current: null | GroupID
    },
    {
      notifier: RpcNotifier<GroupRpcDefinition<C>>
    }
  >
  group: Record<
    GroupID,
    {
      name: string
      owner: UserID
      player: UserID[]
      config: C
    }
  >

  static create<C extends GroupGameConfig, InputMessage>(
    factory: IWebSocketServerFactory,
    port: number,
    defaultConfig: C
  ): Promise<GroupServer<C, InputMessage>> {
    return new Promise(resolve => {
      new GroupServer<C, InputMessage>(
        factory,
        port,
        defaultConfig,
        function () {
          resolve(this)
        }
      )
    })
  }

  test_session(ss: SessionID) {
    return this.user.test(ss).match(
      o => o,
      () => {
        throw GroupError.SessionInvalid
      }
    )
  }

  test_gid(gid: GroupID) {
    if (!(gid in this.group)) {
      throw GroupError.GroupNotExist
    }
    return this.group[gid]
  }

  check_if_not_in_group(info: ReturnType<typeof this.test_session>) {
    if (info.user.extra.current) {
      throw GroupError.AlreadyInGroup
    }
  }

  check_if_in_group(info: ReturnType<typeof this.test_session>): GroupID {
    if (!info.user.extra.current) {
      throw GroupError.NotInGroup
    }
    return info.user.extra.current
  }

  async break_group(gid: GroupID) {
    const group = this.test_gid(gid)
    group.player.forEach(p => {
      this.user.query(p).unwrap().user.extra.current = null
    })
    await this.notify_all(gid, 'current_group_breaked', (id, ss) => ({
      session: ss,
    }))
    delete this.group[gid]
  }

  async notify_every<MM extends keyof GroupRpcDefinition<C>['notify'] & string>(
    request: MM,
    payload:
      | GroupRpcDefinition<C>['notify'][MM]
      | ((id: UserID, ss: SessionID) => GroupRpcDefinition<C>['notify'][MM])
  ) {
    const rp = payload instanceof Function ? payload : () => payload
    return Promise.all(
      Object.keys(this.user.session).map(ss => {
        const info = this.user.test(ss).unwrap()
        return info.session.extra.notifier(
          request,
          rp(info.user.id, info.session.id)
        )
      })
    )
  }

  async notify_all<MM extends keyof GroupRpcDefinition<C>['notify'] & string>(
    gid: string,
    request: MM,
    payload:
      | GroupRpcDefinition<C>['notify'][MM]
      | ((
          id: UserID,
          ss: SessionID,
          pos: number
        ) => GroupRpcDefinition<C>['notify'][MM])
  ) {
    const rp = payload instanceof Function ? payload : () => payload
    const group = this.test_gid(gid)
    return Promise.all(
      group.player.map((uid, pos) => {
        const ss = this.user.query(uid).unwrap().session?.id
        if (ss) {
          this.user
            .test(ss)
            .unwrap()
            .session?.extra.notifier(request, rp(uid, ss, pos))
        }
      })
    )
  }

  async notify_all_updated(gid: string) {
    return this.notify_all(gid, 'current_group_updated', (id, ss) => ({
      session: ss,
      group: gid,
    }))
  }

  constructor(
    factory: IWebSocketServerFactory,
    port: number,
    defaultConfig: C,
    started: (this: GroupServer<C, InputMessage>) => void
  ) {
    this.gserver = new RemoteServer(factory, port + 1)
    this.server = new WsRpcServer(
      factory,
      port,
      {
        register: async ({ name, pswdHash }, notifier) => {
          return this.user
            .register(
              name,
              pswdHash,
              {
                current: null,
              },
              {
                notifier,
              }
            )
            .match(
              ({ ss, id }) => {
                notifier('group_list_updated', {
                  session: ss,
                })
                return Ok({
                  session: ss,
                  id,
                  name,
                })
              },
              e => Err(e)
            )
        },
        login: async ({ name, pswdHash }, notifier) => {
          return this.user
            .login(name, pswdHash, {
              notifier,
            })
            .match(
              ({ ss }) => {
                const info = this.test_session(ss)
                notifier('group_list_updated', {
                  session: ss,
                })
                if (info.user.extra.current) {
                  notifier('current_group_updated', {
                    session: ss,
                    group: info.user.extra.current,
                  })
                }
                return Ok({
                  session: ss,
                  id: info.user.id,
                  name: info.user.name,
                  ingroup: !!info.user.extra.current,
                })
              },
              e => Err(e)
            )
        },
        login_session: async ({ session }, notifier) => {
          return this.user.test(session).match(
            info => {
              info.session.extra.notifier = notifier
              notifier('group_list_updated', {
                session,
              })
              if (info.user.extra.current) {
                notifier('current_group_updated', {
                  session,
                  group: info.user.extra.current,
                })
              }
              return Ok({
                id: info.user.id,
                name: info.user.name,
                ingroup: !!info.user.extra.current,
              })
            },
            err => Err(err)
          )
        },
        query_user: async ({ session, ids }) => {
          this.test_session(session)
          return Ok(
            ids.map(uid =>
              this.user.query(uid).match(
                x => ({
                  id: uid,
                  name: x.user.name,
                  current: x.user.extra.current,
                }),
                () => null
              )
            )
          )
        },
        new_group: async ({ session }) => {
          const info = this.test_session(session)
          this.check_if_not_in_group(info)
          const gid = uuidv4()
          this.group[gid] = {
            name: `${info.user.name}'s House`,
            owner: info.user.id,
            player: [info.user.id],
            config: defaultConfig,
          }
          info.user.extra.current = gid
          this.notify_every('group_list_updated', (id, ss) => ({
            session: ss,
          }))
          this.notify_all_updated(gid)
          return Ok(gid)
        },
        list_group: async ({ session }) => {
          this.test_session(session)
          return Ok(
            Object.keys(this.group).map(gid => ({
              name: this.group[gid].name,
              id: gid,
            }))
          )
        },
        query_group: async ({ session, id }) => {
          this.test_session(session)
          const g = this.test_gid(id)
          return Ok({
            ...g,
            id,
            playerNames: g.player.map(u => this.user.user[u].name),
          })
        },
        enter_group: async ({ session, id }) => {
          const info = this.test_session(session)
          this.check_if_not_in_group(info)
          const g = this.test_gid(id)
          if (g.player.length === g.config.max_players) {
            throw GroupError.GroupFull
          }
          this.group[id].player.push(info.user.id)
          info.user.extra.current = id
          this.notify_all_updated(id)
          return Ok(true)
        },
        leave_group: async ({ session }) => {
          const info = this.test_session(session)
          const id = this.check_if_in_group(info)
          const g = this.group[id]
          g.player = g.player.filter(v => v !== info.user.id)
          info.user.extra.current = null
          if (info.user.id === g.owner) {
            this.break_group(id).then(() => {
              this.notify_every('group_list_updated', (id, ss) => ({
                session: ss,
              }))
            })
          } else {
            this.notify_all_updated(id)
          }
          return Ok(true)
        },
        start_game: async ({ session }) => {
          const info = this.test_session(session)
          const id = this.check_if_in_group(info)
          const g = this.group[id]
          if (info.user.id !== g.owner) {
            throw GroupError.UserNotOwner
          }
          if (g.player.length < g.config.min_players) {
            throw GroupError.PlayerNotEnough
          }
          const game = uuidv4()
          this.gserver.add(game, g.player, g.config)
          this.notify_all(id, 'game_started', (id, ss, pos) => ({
            game,
            port: port + 1,
            pos,
            id,
            config: g.config,
          }))
          this.break_group(id).then(() => {
            this.notify_every('group_list_updated', (id, ss) => ({
              session: ss,
            }))
          })
          return Ok(true)
        },
      },
      () => {
        started.call(this)
      }
    )
    this.group = {}
    this.user = new UserManager()
  }
}

enum State {
  Init,
  Login,
  Enter,
}

export class GroupClient<C extends GroupGameConfig> {
  client: WsRpcClient<GroupRpcDefinition<C>>
  target: string
  data: {
    state: State
    session: SessionID | null
    id: UserID | null
    name: string | null
    group_list: {
      name: string
      id: GroupID
    }[]
    group: {
      id: GroupID
      name: string
      owner: UserID
      player: UserID[]
      config: C
      playerNames: string[]
    } | null
  }
  gameStarted: Signal<{
    target: string
    port: number
    id: UserID
    game: GameID
    pos: number
    config: C
  }>

  static async create<C extends GroupGameConfig>(
    factory: IWebSocketClientFactory,
    url: string,
    port: number
  ): Promise<GroupClient<C>> {
    return new Promise(resolve => {
      WsRpcClient.create<GroupRpcDefinition<C>>(
        factory,
        `ws://${url}:${port}`
      ).then($ => {
        resolve(new GroupClient<C>($[ClientSymbol], url))
      })
    })
  }

  constructor(client: WsRpcClient<GroupRpcDefinition<C>>, target: string) {
    this.client = client
    this.target = target
    this.data = reactive({
      state: State.Init,
      session: null,
      id: null,
      name: null,
      group_list: [],
      group: null,
    })
    this.gameStarted = new Signal()

    this.client.notify = {
      group_list_updated: async ({ session }) => {
        this.data.group_list = await client.$.list_group({
          session,
        }).then(r => r.unwrap())
      },
      current_group_updated: async ({ session, group }) => {
        this.data.group = await client.$.query_group({
          session: session,
          id: group,
        }).then(r => r.unwrap())
      },
      current_group_breaked: async () => {
        this.data.group = null
        this.data.state = State.Login
      },
      game_started: async ({ game, port, pos, id, config }) => {
        await this.gameStarted.emit({
          target: this.target,
          port,
          pos,
          game,
          id,
          config,
        })
      },
    }
  }

  async register(name: string, password: string) {
    if (this.data.state !== State.Init) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.register({
        name,
        pswdHash: Md5(`SCTAVERN-EMULATOR:${name}:${password}`),
      })
    ).match(
      ({ session, id, name }) => {
        this.data.session = session
        this.data.id = id
        this.data.name = name
        this.data.state = State.Login
        return Ok(true)
      },
      err => Err(err)
    )
  }

  async login(name: string, password: string) {
    if (this.data.state !== State.Init) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.login({
        name,
        pswdHash: Md5(`SCTAVERN-EMULATOR:${name}:${password}`),
      })
    ).match(
      ({ session, id, name, ingroup }) => {
        this.data.session = session
        this.data.id = id
        this.data.name = name
        this.data.state = ingroup ? State.Enter : State.Login
        return Ok(true)
      },
      err => Err(err)
    )
  }

  async login_session(ss: SessionID) {
    if (this.data.state !== State.Init) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.login_session({
        session: ss,
      })
    ).match(
      ({ id, name, ingroup }) => {
        this.data.session = ss
        this.data.id = id
        this.data.name = name
        this.data.state = ingroup ? State.Enter : State.Login
        return Ok(true)
      },
      err => Err(err)
    )
  }

  async new_group() {
    if (this.data.state !== State.Login) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.new_group({
        session: this.data.session as string,
      })
    ).match(
      () => {
        this.data.state = State.Enter
        return Ok(true)
      },
      err => {
        if (err === GroupError.SessionInvalid) {
          this.data.state = State.Init
          this.data.session = null
        }
        return Err(err)
      }
    )
  }

  async enter_group(id: GroupID) {
    if (this.data.state !== State.Login) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.enter_group({
        session: this.data.session as string,
        id,
      })
    ).match(
      ok => {
        this.data.state = State.Enter
        return Ok(ok)
      },
      err => {
        if (err === GroupError.SessionInvalid) {
          this.data.state = State.Init
          this.data.session = null
        }
        return Err(err)
      }
    )
  }

  async leave_group() {
    if (this.data.state !== State.Enter) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.leave_group({
        session: this.data.session as string,
      })
    ).match(
      ok => {
        this.data.state = State.Login
        return Ok(ok)
      },
      err => {
        if (err === GroupError.SessionInvalid) {
          this.data.state = State.Init
          this.data.session = null
        }
        return Err(err)
      }
    )
  }

  async start_game() {
    if (this.data.state !== State.Enter) {
      return Err<GroupError.StateNotMatch>(GroupError.StateNotMatch)
    }
    return (
      await this.client.$.start_game({
        session: this.data.session as string,
      })
    ).match(
      ok => Ok(ok),
      err => {
        if (err === GroupError.SessionInvalid) {
          this.data.state = State.Init
          this.data.session = null
        }
        return Err(err)
      }
    )
  }
}
