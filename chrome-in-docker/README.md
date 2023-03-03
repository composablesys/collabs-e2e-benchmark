# chrome-in-docker

Source for a Docker container that runs Chrome and points it to `$URL`, running until killed.

The container prints data to STDOUT:

- CPU, memory, and network usage every second.
- All browser console logs, timestamped. End-to-end latency measurements are generated from these logs, which print whenever a user initiates or receives an operation.
