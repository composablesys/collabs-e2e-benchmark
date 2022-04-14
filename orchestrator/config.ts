// type Frameworks = 'owebsync' | 'sharedb' | 'yjs' | 'automerge' | 'sharedb'
type Frameworks = "yjs" | "collabs" | "automerge"; // TODO: all frameworks

export interface Config {
  numberOfRuns: number;
  params: {
    numberOfObjects: number[]; // originally: 100 | 1000
    numberOfClients: number[]; // originally: 8 | 16 | 24
    scenario: ("online" | "offline" | "dynamic")[];
    duration: number; // 600
    rate: number; // 1000
  };
  instances: {
    flavor: "c4m4" | "cp4m8";
    image: "Ubuntu 18.04.2 with Docker";
  };
  subjects: Frameworks[];
  browserImage: "172.16.29.164/browser:1.0.0";
  serverImage: "TODO";
}
