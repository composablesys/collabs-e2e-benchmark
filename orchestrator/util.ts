import Docker from "dockerode";
import fs from "fs";
import { IncomingMessage } from "http";
import fetch from "node-fetch";
import { readStats } from "./stats";

export const collectStats = async (container: Docker.Container, file) => {
  const msg = (await container.stats({ stream: true })) as unknown;
  const readStream = msg as IncomingMessage;
  const writeStream = fs.createWriteStream(file);
  readStats(readStream, writeStream);
};

export const collectLogs = async (container: Docker.Container, file) => {
  const stream = await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
  });
  const writeStream = fs.createWriteStream(file);
  container.modem.demuxStream(stream, writeStream, writeStream);
};

export const delayNetwork = async (container: Docker.Container) => {
  const cmd = await container.exec({
    Cmd: [
      "tc",
      "qdisc",
      "add",
      "dev",
      "eth0",
      "root",
      "netem",
      "delay",
      "60ms",
      "10ms",
    ],
    Privileged: true,
    AttachStderr: true,
    AttachStdout: true,
  });
  const stream = await cmd.start();
  container.modem.demuxStream(stream.output, process.stdout, process.stderr);
};

export const dropNetwork = async (container: Docker.Container) => {
  const cmd = await container.exec({
    Cmd: ["tc", "qdisc", "add", "dev", "eth0", "root", "netem", "loss", "100%"],
    Privileged: true,
    AttachStderr: true,
    AttachStdout: true,
  });
  const stream = await cmd.start();
  container.modem.demuxStream(stream.output, process.stdout, process.stderr);
};

export const clearNetwork = async (container: Docker.Container) => {
  const cmd = await container.exec({
    Cmd: ["tc", "qdisc", "del", "dev", "eth0", "root"],
    Privileged: true,
    AttachStderr: true,
    AttachStdout: true,
  });
  const stream = await cmd.start();
  container.modem.demuxStream(stream.output, process.stdout, process.stderr);
};

export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });

export const waitOnSuccess = async (
  f: () => void | Promise<void>,
  retryTime: number
) => {
  while (true) {
    try {
      await f();
      break;
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, retryTime);
      });
    }
  }
};
