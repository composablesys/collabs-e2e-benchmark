import { SyncFramework } from '../src/app'

declare const OWebSync: any

class OWebSyncFramework extends SyncFramework {

  private readonly owebsync: any

  constructor() {
    super()

    this.owebsync = new OWebSync(
      'owebsync-worker.js',
      {
        serverUrl: `${window.location.hostname}:8081`,
        roots: [''],
        debug: this.debug,
        nop2p: this.nop2p,
        nos2p: this.nos2p,
      })

    this.owebsync.listenKeys('drawing1', (id: string) => {
      this.owebsync.listen(`drawing1.${id}`, (doc: any) => {
        this.notifyObjectChanged(id, doc)
      })
    })
  }

  protected addObject(id: string, obj: any): void {
    this.owebsync.update(`drawing1.${id}`, obj)
  }

  protected updateObject(id: string, obj: any): void {
    this.owebsync.update(`drawing1.${id}`, obj)
  }

  protected removeObject(id: string): void {
    this.owebsync.remove(`drawing1.${id}`)
  }
}

new OWebSyncFramework().start()
