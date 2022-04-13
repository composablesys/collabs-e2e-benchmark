import Docker from "dockerode";
import fs, { promises as fsp } from "fs";
import { IncomingMessage } from "http";
import path from "path";
import { AzureCloud } from "./azure";
import { Config } from "./config";
import {
  clearNetwork,
  collectLogs,
  collectStats,
  delayNetwork,
  dropNetwork,
  sleep,
  waitOnSuccess,
} from "./util";

(async () => {
  if (!process.env.STORAGE) {
    const file = await fsp.readFile(process.argv[2], "utf8");
    const config = JSON.parse(file) as Config;

    const dnetCloud = new AzureCloud();

    const neededServerImages: string[] = [config.browserImage];
    const neededClientImages: string[] = [config.browserImage];
    for (const subjectName of config.subjects) {
      const subject = config.subjectsDefs[subjectName];
      neededServerImages.push(subject.server);
      neededServerImages.push(subject.web);
    }

    //const vms: string[] = []
    process.on("SIGINT", async () => {
      process.exit();
    });
    try {
      const [serverVM, freeVM, ...clientVMs] = await Promise.all(
        [...new Array(10).keys()].map(async (id) => {
          const name = `${id}`;

          let vm = await dnetCloud.getVM(name);
          if (vm == null) {
            console.log(
              new Date().toISOString(),
              `Launching VM "${name}" (${config.instances.flavor})...`
            );
            vm = await dnetCloud.startVM(
              name,
              config.instances.flavor,
              config.instances.image
            );
            //vms.push(vm)
          } else {
            console.log(
              new Date().toISOString(),
              `Reusing VM "${name}" (${config.instances.flavor})`
            );
          }

          const ip = await dnetCloud.getIP(vm);
          const docker = new Docker({
            host: ip,
            port: "2375",
            version: "v1.39",
          });
          await waitOnSuccess(async () => {
            await docker.info();
          }, 1000);

          console.log(
            new Date().toISOString(),
            `[${name}@${ip}] Cleanup old containers...`
          );
          const oldContainers = await docker.listContainers();
          for (const oldContainerInfo of oldContainers) {
            const oldContainer = await docker.getContainer(oldContainerInfo.Id);
            try {
              await oldContainer.kill();
            } catch {
              // ignore, as long as remove works
            }
            await oldContainer.remove();
          }

          console.log(
            new Date().toISOString(),
            `[${name}@${ip}] Pulling docker images...`
          );
          let images: string[];
          if (id === 0) {
            images = neededServerImages;
          } else {
            images = neededClientImages;
          }
          await Promise.all(
            images.map(async (image) => {
              const msg = (await docker.pull(image, {
                authconfig: {
                  username: "owebsync",
                  password: "...",
                  serveraddress: "owebsync.azurecr.io",
                },
              })) as IncomingMessage;
              await new Promise((resolve) => {
                msg.addListener("close", resolve);
                msg.pipe(fs.createWriteStream("/dev/null"));
              });
            })
          );

          return {
            i: id - 1,
            name,
            docker,
            vm,
            ip,
          };
        })
      );

      for (let i = 0; i < config.numberOfRuns; i++) {
        for (const numberOfObjects of config.params.numberOfObjects) {
          for (const numberOfClients of config.params.numberOfClients) {
            for (const scenario of config.params.scenario) {
              for (const subjectName of config.subjects) {
                const subject = config.subjectsDefs[subjectName];
                const testDir = path.join(
                  "/data",
                  `test-${numberOfObjects}-${numberOfClients}-${scenario}-${subjectName}`
                );
                if (!fs.existsSync(testDir)) {
                  await fsp.mkdir(testDir);
                }

                console.log(
                  new Date().toISOString(),
                  `(${i + 1}/${config.numberOfRuns})`,
                  testDir
                );

                const testDirI = path.join(testDir, `run-${i}-${Date.now()}`);
                await fsp.mkdir(testDirI);
                const statsDir = path.join(testDirI, "stats");
                await fsp.mkdir(statsDir);
                const logsDir = path.join(testDirI, "logs");
                await fsp.mkdir(logsDir);

                console.log(new Date().toISOString(), "Starting server...");
                const serverContainer = await serverVM.docker.createContainer({
                  Image: subject.server,
                  HostConfig: {
                    PortBindings: {
                      "8081/tcp": [{ HostPort: "8081" }],
                      "8000/tcp": [{ HostPort: "8000" }],
                      "443/tcp": [{ HostPort: "443" }],
                    },
                  },
                  ExposedPorts: {
                    "8081/tcp": {},
                    "8000/tcp": {},
                    "443/tcp": {},
                  },
                });
                await serverContainer.start();
                collectStats(
                  serverContainer,
                  path.join(statsDir, "server.csv")
                );
                collectLogs(serverContainer, path.join(logsDir, "server.txt"));
                await delayNetwork(serverContainer);

                console.log(new Date().toISOString(), "Starting web...");
                const webContainer = await serverVM.docker.createContainer({
                  Image: subject.web,
                  HostConfig: {
                    PortBindings: {
                      "80/tcp": [{ HostPort: "8080" }],
                    },
                  },
                  ExposedPorts: {
                    "80/tcp": {},
                  },
                });
                await webContainer.start();

                console.log(
                  new Date().toISOString(),
                  "Starting init browser..."
                );
                const initBrowserContainer =
                  await serverVM.docker.createContainer({
                    Image: config.browserImage,
                    Env: [
                      `URL=http://${serverVM.ip}:8080?add=${numberOfObjects}&nogui`,
                    ],
                  });
                await initBrowserContainer.start();
                collectStats(
                  initBrowserContainer,
                  path.join(statsDir, "init.csv")
                );
                collectLogs(
                  initBrowserContainer,
                  path.join(logsDir, "init.txt")
                );

                console.log(new Date().toISOString(), "Wait 60s");
                await sleep(60);
                await initBrowserContainer.kill();
                await initBrowserContainer.remove();

                console.log(
                  new Date().toISOString(),
                  "Starting client browsers..."
                );
                const numContainersPerClient = numberOfClients / 8;
                const clientContainers = (
                  await Promise.all(
                    clientVMs.map(async (clientVM) => {
                      return await Promise.all(
                        [...new Array(numContainersPerClient).keys()].map(
                          async (id) => {
                            const clientContainer =
                              await clientVM.docker.createContainer({
                                Image: config.browserImage,
                                Env: [
                                  `URL=http://${serverVM.ip}:8080?shuffle_rate=${config.params.rate}&shuffle_multiplier=1&shuffle_time=${config.params.duration}&shuffle_delay=60&nogui`,
                                ],
                              });
                            await clientContainer.start();
                            collectStats(
                              clientContainer,
                              path.join(
                                statsDir,
                                `client-${clientVM.i}-${id}.csv`
                              )
                            );
                            collectLogs(
                              clientContainer,
                              path.join(
                                logsDir,
                                `client-${clientVM.i}-${id}.txt`
                              )
                            );
                            await delayNetwork(clientContainer);
                            return clientContainer;
                          }
                        )
                      );
                    })
                  )
                ).flat();
                console.log(new Date().toISOString(), "Wait 60s");
                await sleep(60);

                console.log(new Date().toISOString(), "Test started...");
                const start = Date.now();
                await fsp.writeFile(
                  path.join(testDirI, "start.txt"),
                  new Date().toISOString(),
                  "utf8"
                );
                await Promise.all([
                  sleep(config.params.duration),
                  sleep(3 * 60).then(async () => {
                    if (scenario === "offline") {
                      await clearNetwork(serverContainer);
                      await dropNetwork(serverContainer);
                      fsp.writeFile(
                        path.join(testDirI, "failure_start.txt"),
                        new Date().toISOString(),
                        "utf8"
                      );
                      await sleep(60);
                      await clearNetwork(serverContainer);
                      delayNetwork(serverContainer);
                      fsp.writeFile(
                        path.join(testDirI, "failure_end.txt"),
                        new Date().toISOString(),
                        "utf8"
                      );
                    }
                  }),
                ]);
                await fsp.writeFile(
                  path.join(testDirI, "end.txt"),
                  new Date().toISOString(),
                  "utf8"
                );
                console.log(new Date().toISOString(), "Test done");

                await sleep(10); // to make sure all logs are passed through

                console.log(new Date().toISOString(), "Cleaning up...");
                await Promise.all(
                  [serverContainer, webContainer, ...clientContainers].map(
                    async (c) => {
                      try {
                        await c.kill();
                      } catch {
                        // ignore, as long as remove works
                      }
                      await c.remove();
                    }
                  )
                );
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      // await Promise.all(vms.map(vm => dnetCloud.destroyVM(vm)))
    }
    process.exit();
  } else {
    const file = await fsp.readFile(process.argv[2], "utf8");
    const config = JSON.parse(file) as Config;

    const dnetCloud = new AzureCloud();

    const neededImages: string[] = [config.browserImage];
    for (const subjectName of config.subjects) {
      const subject = config.subjectsDefs[subjectName];
      neededImages.push(subject.server);
      neededImages.push(subject.web);
    }

    process.on("SIGINT", async () => {
      process.exit();
    });

    try {
      const name = "extra-" + config.subjects[0];
      let vm = await dnetCloud.getVM(name);
      if (vm == null) {
        console.log(
          new Date().toISOString(),
          `Launching VM "${name}" (${config.instances.flavor})...`
        );
        vm = await dnetCloud.startVM(
          name,
          config.instances.flavor,
          config.instances.image
        );
      } else {
        console.log(
          new Date().toISOString(),
          `Reusing VM "${name}" (${config.instances.flavor})`
        );
      }

      const ip = await dnetCloud.getIP(vm);
      const docker = new Docker({
        host: ip,
        port: "2375",
        version: "v1.39",
      });
      await waitOnSuccess(async () => {
        await docker.info();
      }, 1000);

      console.log(
        new Date().toISOString(),
        `[${name}@${ip}] Cleanup old containers...`
      );
      const oldContainers = await docker.listContainers();
      for (const oldContainerInfo of oldContainers) {
        const oldContainer = await docker.getContainer(oldContainerInfo.Id);
        try {
          await oldContainer.kill();
        } catch {
          // ignore, as long as remove works
        }
        await oldContainer.remove();
      }

      console.log(
        new Date().toISOString(),
        `[${name}@${ip}] Pulling docker images...`
      );
      await Promise.all(
        neededImages.map(async (image) => {
          const msg = (await docker.pull(image, {
            authconfig: {
              username: "owebsync",
              password: "...",
              serveraddress: "owebsync.azurecr.io",
            },
          })) as IncomingMessage;
          await new Promise((resolve) => {
            msg.addListener("close", resolve);
            msg.pipe(fs.createWriteStream("/dev/null"));
          });
        })
      );

      for (let i = 0; i < config.numberOfRuns; i++) {
        for (const numberOfObjects of config.params.numberOfObjects) {
          for (const subjectName of config.subjects) {
            const subject = config.subjectsDefs[subjectName];
            const testDir = path.join(
              "/data",
              `test-extra-${numberOfObjects}-${subjectName}`
            );
            if (!fs.existsSync(testDir)) {
              await fsp.mkdir(testDir);
            }

            console.log(
              new Date().toISOString(),
              `(${i + 1}/${config.numberOfRuns})`,
              testDir
            );

            const testDirI = path.join(testDir, `run-${i}-${Date.now()}`);
            await fsp.mkdir(testDirI);
            const logsDir = path.join(testDirI, "logs");
            await fsp.mkdir(logsDir);

            console.log(new Date().toISOString(), "Starting server...");
            const serverContainer = await docker.createContainer({
              Image: subject.server,
              HostConfig: {
                PortBindings: {
                  "8081/tcp": [{ HostPort: "8081" }],
                  "8000/tcp": [{ HostPort: "8000" }],
                  "443/tcp": [{ HostPort: "443" }],
                },
              },
              ExposedPorts: {
                "8081/tcp": {},
                "8000/tcp": {},
                "443/tcp": {},
              },
              Env: ["DATA_DUMP=1"],
            });
            await serverContainer.start();
            collectLogs(serverContainer, path.join(logsDir, "server.txt"));

            console.log(new Date().toISOString(), "Starting web...");
            const webContainer = await docker.createContainer({
              Image: subject.web,
              HostConfig: {
                PortBindings: {
                  "80/tcp": [{ HostPort: "8080" }],
                },
              },
              ExposedPorts: {
                "80/tcp": {},
              },
            });
            await webContainer.start();

            console.log(new Date().toISOString(), "Starting init browser...");
            const initBrowserContainer = await docker.createContainer({
              Image: config.browserImage,
              Env: [`URL=http://${ip}:8080?add=${numberOfObjects}&nogui`],
            });
            await initBrowserContainer.start();
            collectLogs(initBrowserContainer, path.join(logsDir, "init.txt"));
            console.log(new Date().toISOString(), "Wait 60s");
            await sleep(60);
            await initBrowserContainer.kill();
            await initBrowserContainer.remove();

            console.log(new Date().toISOString(), "Test started...");
            await fsp.writeFile(
              path.join(testDirI, "start.txt"),
              new Date().toISOString(),
              "utf8"
            );
            const start = Date.now();
            while (Date.now() < start + config.params.duration * 1000) {
              await Promise.all(
                [...new Array(5).keys()].map(async () => {
                  const clientContainer = await docker.createContainer({
                    Image: config.browserImage,
                    Env: [
                      `URL=http://${ip}:8080?shuffle_rate=250&shuffle_time=600&shuffle_delay=10&nogui`,
                    ],
                  });
                  await clientContainer.start();
                  collectLogs(
                    clientContainer,
                    path.join(
                      logsDir,
                      `client-${Math.random().toString().slice(2)}.txt`
                    )
                  );
                  await sleep(610);
                  await clientContainer.kill();
                  await clientContainer.remove();
                })
              );
            }
            await fsp.writeFile(
              path.join(testDirI, "end.txt"),
              new Date().toISOString(),
              "utf8"
            );
            console.log(new Date().toISOString(), "Test done");

            await sleep(10); // to make sure all logs are passed through

            console.log(new Date().toISOString(), "Cleaning up...");
            await Promise.all(
              [serverContainer, webContainer].map(async (c) => {
                try {
                  await c.kill();
                } catch {
                  // ignore, as long as remove works
                }
                await c.remove();
              })
            );
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      process.exit();
    }
  }
})();
