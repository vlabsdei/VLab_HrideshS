


> [!NOTE]
> **Simulator Note**: The calculations and results in this lab are obtained using the simulator's simplified and exaggerated latency model. To make the topology differences visually observable, parameters like switch latency (200 &mu;s) and propagation delay (5 &mu;s) are artificially scaled up compared to their real-world nanosecond equivalents. Refer to the Theory section for details on these educational assumptions.

## Step 1: Launch the Simulation

1. Open the **InfiniBand Network Topology Latency Virtual Lab**.
2. Note the default configuration:

| Parameter              | Default Value          |
| ---------------------- | ---------------------- |
| Network Topology       | Fat-Tree (Spine-Leaf)  |
| Total GPU Clusters (N) | 64 endpoints           |
| InfiniBand Link        | NDR (400 Gbps)         |
| Payload Size (S)       | 10 MB                  |

---

## Step 2: Compare Topologies at Fixed Cluster Size

1. Set N = 64, Link = NDR, Payload = 10 MB.
2. Switch between topologies:

| Topology  | Hops (H) | Serialization (ms) | Total Delay (ms) |
| --------- | --------- | ------------------- | ----------------- |
| Fat-Tree  |           |                     |                   |
| 3D Torus  |           |                     |                   |

---

## Step 3: Study Cluster Size Scaling

1. Set Topology to **3D Torus**, Link = NDR, Payload = 10 MB.
2. Increase cluster size:

| Cluster Size (N) | Hops (H) | Total Delay (ms) |
| ----------------- | --------- | ----------------- |
| 32                |           |                   |
| 64                |           |                   |
| 128               |           |                   |
| 256               |           |                   |
| 512               |           |                   |
| 1024              |           |                   |

3. Repeat with Fat-Tree and compare hop counts.

---

## Step 4: Compare InfiniBand Link Standards

1. Set Topology = Fat-Tree, N = 256, Payload = 100 MB.

| Link Standard | Bandwidth | Serialization (ms) | Total Delay (ms) |
| ------------- | --------- | ------------------- | ----------------- |
| NDR           | 400 Gbps  |                     |                   |
| XDR           | 800 Gbps  |                     |                   |

---

## Step 5: Study Payload Size Effects

1. Set Topology = Fat-Tree, N = 128, Link = NDR.

| Payload (MB) | Serialization (ms) | Total Delay (ms) |
| ------------- | ------------------- | ----------------- |
| 1             |                     |                   |
| 10            |                     |                   |
| 50            |                     |                   |
| 100           |                     |                   |
| 500           |                     |                   |

---

## Step 6: Verify the Delay Formula

<p align="center">
  <i>T<sub>net</sub> = T<sub>s</sub> + (H &times; T<sub>switch</sub>) + (Distance &times; Propagation Delay)</i>
</p>

1. Calculate manually for selected parameters.
2. Compare with simulation output.

---

# Observation

Record all measured values. Note how Fat-Tree maintains constant hops while 3D Torus hops scale with cluster size.

---

# Result

The effects of network topology, cluster size, InfiniBand link standard, and payload size on worst-case routing hops and total network latency were successfully studied. The experiment demonstrated why Fat-Tree topologies are preferred for large-scale computing despite higher cabling costs.
