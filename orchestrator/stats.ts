import { ContainerStats } from 'dockerode'
import { WriteStream } from 'fs'
import { IncomingMessage } from 'http'

export const readStats = (readStream: IncomingMessage, writeStream: WriteStream) => {
  writeStream.setDefaultEncoding('utf8')
  readStream.setEncoding('utf8')

  writeStream.write('Time, CPU (ns), CPU (%), MEM (MB), MEM (%), RECEIVE (KB), SEND (KB)\n')

  readStream.on('data', (chunk: string) => {
    try {
      const stats = JSON.parse(chunk) as ContainerStats
      if (stats.read == null) {
        return
      }

      writeStream.write(`${getTime(stats)}, ${getCPUTime(stats)}, ${getCPUPercent(stats).toFixed(2)}, ${getMemoryUsage(stats).toFixed(2)}, ${getMemoryPercent(stats).toFixed(2)}, ${getNetworkReceivedUsage(stats).toFixed(2)}, ${getNetworkSendUsage(stats).toFixed(2)}\n`)
    } catch {
      // ignore
    }
  })
}

const getTime = (stats: ContainerStats): string => {
  return stats.read.slice(0, 22)
}

const getCPUTime = (stats: ContainerStats): number => {
  return stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
}

const getCPUPercent = (stats: ContainerStats): number => {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
  const onlineCPUs = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage.length

  if (systemDelta > 0 && cpuDelta > 0) {
    return cpuDelta / systemDelta * onlineCPUs * 100
  } else {
    return 0
  }
}

const getMemoryUsage = (stats: ContainerStats): number => {
  return stats.memory_stats.usage / 1000 / 1000
}

const getMemoryPercent = (stats: ContainerStats): number => {
  if (stats.memory_stats.limit !== 0) {
    return stats.memory_stats.usage / stats.memory_stats.limit * 100
  } else {
    return 0
  }
}

const getNetworkReceivedUsage = (stats: ContainerStats): number => {
  let rx = 0
  for (const n of Object.keys(stats.networks || {})) {
    rx += stats.networks[n].rx_bytes
  }
  return rx / 1000
}

const getNetworkSendUsage = (stats: ContainerStats): number => {
  let tx = 0
  for (const n of Object.keys(stats.networks || {})) {
    tx += stats.networks[n].tx_bytes
  }
  return tx / 1000
}
