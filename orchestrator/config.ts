type Frameworks = 'owebsync' | 'sharedb' | 'yjs' | 'automerge' | 'sharedb'

export interface Config {
  numberOfRuns: number
  params: {
    numberOfObjects: (100 | 1000)[]
    numberOfClients: (8 | 16 | 24)[]
    scenario: ('online' | 'offline' | 'dynamic')[]
    duration: number // 600
    rate: number // 1000
  }
  instances: {
    flavor: 'c4m4' | 'cp4m8'
    image: 'Ubuntu 18.04.2 with Docker'
  }
  subjects: Frameworks[]
  subjectsDefs: {
    [name in Frameworks]: {
      web: string
      server: string
    }
  }
  browserImage: '172.16.29.164/browser:1.0.0'
}
