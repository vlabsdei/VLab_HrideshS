# Theory

## 1. Introduction

Large-scale AI training and scientific computing require hundreds or thousands of GPUs working together. These GPUs must communicate frequently to exchange data, synchronize computations, and aggregate results. The network that connects these GPUs — the interconnect fabric — plays a critical role in determining overall system performance.

InfiniBand is the dominant high-performance networking technology used in modern HPC and AI clusters. It provides low-latency, high-bandwidth communication between computing nodes.

This experiment investigates how network topology and link speed affect communication latency in InfiniBand-connected GPU clusters.

---

## 2. InfiniBand Technology

InfiniBand is a high-performance networking standard designed for low-latency, high-throughput communication.

| Standard | Bandwidth per Port | Release |
| -------- | ------------------ | ------- |
| HDR      | 200 Gbps           | 2018    |
| NDR      | 400 Gbps           | 2022    |
| XDR      | 800 Gbps           | 2024    |

InfiniBand features:
- Hardware-level RDMA (Remote Direct Memory Access)
- Sub-microsecond latency
- Lossless transport
- Credit-based flow control

---

## 3. Network Topologies

### 3.1 Fat-Tree (Spine-Leaf)

A Fat-Tree topology arranges switches in a hierarchical structure:
- **Leaf switches** connect directly to compute nodes
- **Spine switches** interconnect leaf switches
- Multiple redundant paths exist between any two nodes

Key properties:
- **Fixed hop count**: <i>H = 4</i> (simplified baseline used in this simulator)
- **Predictable latency**: Every node pair has the same number of hops
- **High bisection bandwidth**: Full bandwidth between any two halves of the network
- **High cabling cost**: Requires many switch-to-switch connections


> **Note on Fat-Tree Hop-Count**: For simplicity, this simulator models a fixed 4-hop path (Node A → Leaf Switch → Spine Switch → Leaf Switch → Node B) representing a traditional cluster-wide traverse. In actual multi-tier Fat-Tree networks, the hop count can vary depending on whether the communication is local to the same leaf switch (2 hops) or requires traversing higher network layers (e.g., 6 hops in a 3-tier tree).

### 3.2 3D Torus

A 3D Torus topology arranges nodes in a three-dimensional grid with wrap-around connections:
- Each node connects to its six nearest neighbors (±x, ±y, ±z)
- Wrap-around links connect opposite edges

Key properties:
- **Variable hop count**: <i>H = &lfloor;&#179;&radic;N&rfloor;</i> (approximate scaling used in this simulator)
- **Variable latency**: Depends on source-destination distance
- **Lower cabling cost**: Each node has a fixed number of connections
- **Higher latency at scale**: Large clusters have many routing hops

 > **Note on Hop-Count Approximation**: In this educational simulator, the average hop count for a 3D Torus is approximated as <i>H = &lfloor;&#179;&radic;N&rfloor;</i> to illustrate the <i>O(&#179;&radic;N)</i> scaling behavior. In production InfiniBand networks, the exact average hop count depends on the specific routing algorithm (e.g., Dimension-Order Routing), topology dimensions (e.g., <i>X &times; Y &times; Z</i>), and traffic patterns (which typically average <i>&approx; &frac34; N<sup>1/3</sup></i> for a symmetric torus).

---

## 4. Serialization Latency

Serialization latency is the time required to transmit a message payload onto the network link:

<p align="center">
  <i>T<sub>s</sub> = S / Bandwidth</i>
</p>

Where:
| Symbol     | Description                     |
| ---------- | ------------------------------- |
| <i>T<sub>s</sub></i>      | Serialization Latency (seconds) |
| <i>S</i>        | Payload Size (bytes)            |
| Bandwidth  | Link throughput (bytes/second)  |

---

## 5. Hop-Based Routing Delay

Each network hop introduces additional latency from switch processing:

<p align="center">
  <i>Hop Delay = H &times; T<sub>switch</sub></i>
</p>

Where <i>T<sub>switch</sub></i> is the per-switch processing latency. In reality, a high-performance InfiniBand switch has a latency of typically 100–300 ns (e.g., 200 ns or 0.2 &mu;s). However, to make the latency differences between topologies visually observable and exaggerated for educational purposes, the simulator artificially scales the switch latency (<i>T<sub>switch</sub></i>) up to 200 &mu;s. The exaggerated values ensure the delays are visually pronounced on the dashboard.
### Fat-Tree Hops
For Fat-Tree topology: **H = 4** (constant, baseline simulator model)

### 3D Torus Hops
For 3D Torus topology: **H = ⌊³√N⌋** (scales with cube root of node count, educational approximation)

---

## 6. Total Network Fabric Delay

The total end-to-end network delay combines all components:

<p align="center">
  <i>T<sub>net</sub> = T<sub>s</sub> + (H &times; T<sub>switch</sub>) + (Distance &times; Propagation Delay)</i>
</p>

Where propagation delay accounts for the physical signal travel time through cables.

---

## 7. Simulation Assumptions

To keep the simulation focused on core topology scaling concepts and ensure the visual educational experience is clear, the following simplifying assumptions and exaggerations are made:
- **Exaggerated Switch Latency**: In reality, switch latency is around 200 ns. The simulator artificially exaggerates this to a fixed 200 &mu;s to make the hop delay calculations visually significant on the dashboard. It also ignores variable queueing delays or switch architecture differences.
- **Exaggerated Propagation Latency**: In reality, cable propagation delay is around 50 ns for a typical 10-meter cable. The simulator exaggerates this to 5 &mu;s per hop. This uniform delay assumes equal cable lengths without physical layout skew.
- **No Network Congestion**: The model assumes contention-free links and perfect routing without packet collisions, packet drops, or retransmissions.
- **Deterministic Routing**: Routing paths are fixed and deterministic (Manhattan routing for Torus, static hierarchy for Fat-Tree).
- **Constant Bandwidth**: Bandwidth is assumed to be fully available and constant (e.g., 400 Gbps for NDR, 800 Gbps for XDR) without packet overhead or protocol encapsulation losses.

---

## 8. Topology Comparison

| Property              | Fat-Tree        | 3D Torus                | Reasoning |
| --------------------- | --------------- | ----------------------- | --------- |
| Latency Predictability| High            | Low                     | Fat-Tree has fixed hierarchical paths; Torus paths vary significantly by node distance. |
| Bisection Bandwidth   | Full            | Limited                 | Fat-Tree's spine layer provides non-blocking bandwidth; Torus bottlenecks at network cross-sections. |
| Cabling Cost          | High            | Low                     | Fat-Tree requires massive spine-to-leaf cabling; Torus relies on simple, local nearest-neighbor links. |
| Scalability           | Excellent       | Good (with latency penalty) | Fat-Tree scales non-blockingly via spine layers; Torus increases average hop distance as nodes are added. |
| Fault Tolerance       | High            | Moderate                | Fat-Tree has abundant redundant spine paths; Torus can segment if multiple adjacent wrap-around links fail. |
| Path Diversity        | High            | Low                     | Fat-Tree offers many equal-cost multi-paths (ECMP); Torus has limited shortest-path routing alternatives. |

---

## 9. Significance of the Experiment

Understanding network topology effects is essential for:
- HPC System Architects
- Data Center Network Engineers
- AI Cluster Designers
- Performance Engineers

---

## Conclusion

Network topology significantly impacts communication latency in large-scale computing clusters. Fat-Tree topologies provide predictable, low-latency communication at the cost of higher cabling complexity, while 3D Torus topologies offer simpler cabling but introduce variable latency that scales with cluster size. Understanding these trade-offs is essential for designing efficient HPC and AI infrastructure.
