# Collabs End-to-End Benchmark

App code and cloud configuration for [Collabs's](https://collabs.readthedocs.io/en/latest/) end-to-end benchmark, as described in [https://arxiv.org/abs/2212.02618](https://arxiv.org/abs/2212.02618).

Modified from the [OWebSync paper's](https://doi.org/10.1109/TPDS.2021.3066276) eDesigners benchmark's code, provided by [Kristof Jannes](https://kristofjannes.com/).

## Organization

- `site/`: Docker container that runs a web server for each framework. This includes the browser code (served from the server) that runs the collaborative app and simulates user actions.
- `chrome-in-docker/`: Docker container that launches Chrome for a single user and points it at the web server. It also records performance stats and browser console logs for later analysis.
- `analysis/`: Analyzes the files output by Chrome instances and generates metrics for the paper.

Note: This repo does not include code to actually deploy the containers in the proper setup (for each framework, start the server container for that framework, then point N clients to it and run them for the experiment duration).
