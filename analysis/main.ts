import fs from "fs";
import path from "path";
import lineReader from "line-reader";
import * as math from "mathjs";

const MAIN_FOLDER = "../data/logs-long";
const LENGTH_SEC = 60;
const BUFFER_SEC = 10; // Need at least this many sec after the end
const TIME_VAR_SEC = 5; // Will accept measurements up to this many seconds late
// The max latency we will report.
const MAX_LATENCY_MS = 10000;

// Processed stats for a single client.
interface Stats {
  cpuUsage: number; // %
  netBytes: number; // Total bytes sent + received
  netInterval: number; // netBytes interval in sec
}

let lib: string;
let numUsers: number;
let numObjects: number;

(async function () {
  const args = process.argv.slice(2);

  // Args: <outFile> <lib> <numUsers> <numObjects> <trials to keep>
  // e.g. collabs 2 20
  if (args.length !== 5) {
    throw new Error("wrong # args");
  }
  const outFile = args[0];
  lib = args[1];
  numUsers = parseInt(args[2]);
  numObjects = parseInt(args[3]);
  const trialsToKeep = parseInt(args[4]);

  const bench = lib + "_" + numUsers + "_" + numObjects;

  const statss: Stats[] = [];
  const latencies: number[] = []; // In ms

  let successfulTrials = 0;
  let unaccounted = 0;
  for (let trial = 1; trial <= 10; trial++) {
    console.log("\n**********\nTRIAL: " + trial + "\n*********\n");
    const subfolder = bench + "_" + trial;
    const result = await getTrialData(subfolder);
    if (result !== null) {
      statss.push(...result[0]);
      for (const lat of result[1]) latencies.push(lat);
      unaccounted += result[2];
      successfulTrials++;
      if (successfulTrials === trialsToKeep) break;
    }
  }

  // Compute summary statistics.
  // - # clients
  // - CPU usage: mean, stddev
  // - Network usage: mean, stddev
  // - Percentile latencies (nearest rank)
  const cpuUsages = statss.map((value) => value.cpuUsage);
  const netUsages = statss.map((value) => value.netBytes / value.netInterval);
  latencies.sort((a, b) => a - b);
  const perLen = latencies.length / 100;
  const results = {
    lib,
    numUsers,
    numObjects,
    count: statss.length,
    cpuUsage: summarize(cpuUsages), // %
    netUsage: summarize(netUsages), // bytes/sec
    l0: latencies[0],
    l1: latencies[Math.ceil(perLen * 1) - 1],
    l10: latencies[Math.ceil(perLen * 10) - 1],
    l25: latencies[Math.ceil(perLen * 25) - 1],
    l50: latencies[Math.ceil(perLen * 50) - 1],
    l75: latencies[Math.ceil(perLen * 75) - 1],
    l90: latencies[Math.ceil(perLen * 90) - 1],
    l95: latencies[Math.ceil(perLen * 95) - 1],
    l98: latencies[Math.ceil(perLen * 98) - 1],
    l99: latencies[Math.ceil(perLen * 99) - 1],
    l100: latencies[latencies.length - 1],
    latUnaccounted: (100 * unaccounted) / latencies.length, // %
  };
  console.log("\n**********\nRESULTS:\n*********\n");
  console.log(results);

  fs.appendFileSync(outFile, JSON.stringify(results) + "\n");
})();

function summarize(values: number[]): any {
  return {
    mean: math.mean(values),
    stdDev: math.std(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

async function getTrialData(
  subfolder: string
): Promise<[Stats[], number[], number] | null> {
  const client1Files: string[] = [];
  for (const fileName of fs.readdirSync(path.join(MAIN_FOLDER, subfolder))) {
    if (fileName.startsWith("client-1-")) client1Files.push(fileName);
  }
  if (client1Files.length !== numUsers) {
    throw new Error("Wrong number of client1 files: " + client1Files.length);
  }

  // 1. Determine the time that all clients have started sending ops,
  // as indicated by logs of the form
  // APP <date> S <id>.<field> <num>
  // I.e., take the maximum such <date>.
  let allStartDate = new Date("2000");
  const validClient1Files: string[] = [];
  for (const file of client1Files) {
    let found = false;
    await eachLine(path.join(MAIN_FOLDER, subfolder, file), (line) => {
      if (line.startsWith("APP ")) {
        const split = line.split(" ");
        if (split[2] === "S") {
          const theDate = new Date(split[1]);
          if (theDate > allStartDate) allStartDate = theDate;
          found = true;
          return false;
        }
      }
    });
    if (found) {
      validClient1Files.push(file);
    } else {
      // console.log("No APP S found in " + path.join(subfolder, file));
    }
  }

  console.log("Valid clients: " + validClient1Files.length);
  console.log("allStartDate: " + allStartDate.toISOString());
  if (validClient1Files.length < numUsers) {
    console.log("  Too few clients, skipping");
    return null;
  }

  // 2. Determine the earliest time that a client stopped sending ops.
  let allEndDate = new Date("2100");
  for (const file of validClient1Files) {
    let fileEndDate = new Date("2000");
    await eachLine(path.join(MAIN_FOLDER, subfolder, file), (line) => {
      if (line.startsWith("APP ")) {
        const split = line.split(" ");
        if (split[2] === "S") {
          fileEndDate = new Date(split[1]);
        }
      }
    });
    if (fileEndDate < allEndDate) allEndDate = fileEndDate;
  }
  console.log("allEndDate: " + allEndDate.toISOString());
  const diff = Math.floor(allEndDate.getTime() - allStartDate.getTime()) / 1000;
  console.log("Length: " + diff + " sec");
  if (diff < LENGTH_SEC + BUFFER_SEC) {
    console.log("  Too short, skipping");
    return null;
  }

  // 3. Determine the CPU and network stats at allStartDate and
  // allStartDate plus LENGTH_SEC seconds
  // for each client, then compute the average:
  // - CPU usage (%)
  // - network usage (bytes/sec).
  const measuredEndDate = new Date(allStartDate.getTime() + LENGTH_SEC * 1000);
  const statss: Stats[] = [];
  for (const file of validClient1Files) {
    const absFile = path.join(MAIN_FOLDER, subfolder, file);
    const startRawStats = await getRawStatsAt(absFile, allStartDate);
    const endRawStats = await getRawStatsAt(absFile, measuredEndDate);

    // CPU usage %. Note this in units of CPU % and counts CPUs
    // with multiplicity (i.e., 2 CPUs max usage -> 200%).
    const totalDifference =
      startRawStats.cpu.totalTick - endRawStats.cpu.totalTick;
    const idleDifference =
      startRawStats.cpu.totalIdle - endRawStats.cpu.totalIdle;
    const cpuUsage =
      (10000 - Math.round((10000 * idleDifference) / totalDifference)) / 100;

    // Network bytes/sec sent & received.
    const netStart = getNet(startRawStats.net);
    const netEnd = getNet(endRawStats.net);
    const sendDiff = netEnd.outputBytes - netStart.outputBytes;
    const receiveDiff = netEnd.inputBytes - netStart.inputBytes;
    const intervalSec =
      (endRawStats.net.time.getTime() - startRawStats.net.time.getTime()) /
      1000;

    const stats: Stats = {
      cpuUsage,
      netBytes: sendDiff + receiveDiff,
      netInterval: intervalSec,
    };
    // console.log(stats);
    statss.push(stats);
  }

  // 4. Calculate end-to-end latencies for all ops sent during the
  // valid period.
  const [latencies, unaccounted] = await getLatencies(
    subfolder,
    validClient1Files,
    allStartDate,
    measuredEndDate
  );

  return [statss, latencies, unaccounted];
}

interface OpDates {
  sends: number[]; // Date.getTime(), so in ms
  receives: number[]; // Date.getTime(), so in ms
}

async function getLatencies(
  subfolder: string,
  validClient1Files: string[],
  startDate: Date,
  endDate: Date
): Promise<[number[], number]> {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  // Maps an op's key "UID.side num" to its dates.
  // Note keys are not necessarily unique; will have to tease them
  // out later.
  const ops = new Map<string, OpDates>();
  for (const file of validClient1Files) {
    await eachLine(path.join(MAIN_FOLDER, subfolder, file), (line) => {
      if (line.startsWith("APP ")) {
        const split = line.split(" ");
        const date = new Date(split[1]);
        const key = split[3] + " " + split[4];
        const type = split[2];

        let op = ops.get(key);
        if (op === undefined) {
          op = { sends: [], receives: [] };
          ops.set(key, op);
        }
        if (type === "S") op.sends.push(date.getTime());
        else op.receives.push(date.getTime());
      }
    });
  }

  // For each op, calculate receive latencies.
  // Since keys are not necessarily unique but collisions are usually
  // spaced out in time,
  // we assume that the next receive after a send is for the exact
  // same op.
  // Also, we only consider sends within the valid period.
  const latencies: number[] = []; // In ms.
  let totalUnaccounted = 0;
  for (const [key, op] of ops) {
    op.sends.sort((a, b) => a - b);
    let validSends = 0;
    for (const send of op.sends) {
      if (startTime <= send && send < endTime) {
        validSends++;
      }
    }

    const opLatencies: number[] = [];
    for (const receive of op.receives) {
      // Find the last send < receive.
      // There may be none, if the op was sent before the valid window.
      for (let i = op.sends.length - 1; i >= 0; i--) {
        if (op.sends[i] < receive) {
          // Only record if the send is in the valid period.
          // Also, only record if it is within MAX_LATENCY_MS - otherwise
          // assume the op was lost and we are seeing a later collision.
          if (startTime <= op.sends[i] && op.sends[i] < endTime) {
            const latency = receive - op.sends[i];
            if (latency <= MAX_LATENCY_MS) opLatencies.push(latency);
          }
          break;
        }
      }
    }

    const expected = validSends * (numUsers - 1);
    const unaccounted = expected - opLatencies.length;
    if (unaccounted > 0) {
      totalUnaccounted += unaccounted;
      for (let i = 0; i < unaccounted; i++) {
        opLatencies.push(MAX_LATENCY_MS);
      }
    }

    for (const opLatency of opLatencies) latencies.push(opLatency);
  }

  return [latencies, totalUnaccounted];
}

function getNet(rawNet: any): { inputBytes: number; outputBytes: number } {
  // Assert that the second interface is eth*:
  if (!(rawNet.length === 2 && rawNet[1].interface.startsWith("eth"))) {
    throw new Error("Unsure about eth interface for " + JSON.stringify(rawNet));
  }
  return rawNet[1];
}

interface RawStats {
  cpu: any;
  mem: any;
  net: any;
}

/**
 * Returns CPU, memory, and network stats for the given client
 * at the first measurement after and within TIME_VAR_SEC
 * seconds of the given time.
 */
async function getRawStatsAt(absFile: string, time: Date): Promise<RawStats> {
  const timeEnd = new Date(time.getTime() + TIME_VAR_SEC * 1000);
  const stat = { CPU: null, MEMORY: null, NETWORK: null };
  let found = 0;
  await eachLine(absFile, (line) => {
    for (const [key, value] of Object.entries(stat)) {
      if (value === null && line.startsWith(key + " ")) {
        const split = line.split(" ");
        const lineTime = new Date(split[1]);
        if (time <= lineTime) {
          // First instance, hope it works.
          if (lineTime > timeEnd) {
            throw new Error("First " + key + " time is too late");
          }
          stat[key] = JSON.parse(split[2]);
          stat[key].time = lineTime;
          found++;
          if (found === 3) return false;
        }
      }
    }
  });
  return { cpu: stat.CPU, mem: stat.MEMORY, net: stat.NETWORK };
}

// Like lineReader.eachLine, but returns only when done.
async function eachLine(file: string, cb: (line: string) => boolean | void) {
  return new Promise<void>((resolve) => {
    lineReader.eachLine(file, (line, last) => {
      const ret = cb(line);
      if (ret === false || last === true) resolve();
      return ret;
    });
  });
}
