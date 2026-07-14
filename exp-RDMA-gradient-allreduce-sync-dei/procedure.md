
## Step 1: Launch the Simulation

1. Open the **RDMA Gradient All-Reduce Sync Virtual Lab**.
2. Note defaults: Gradient Size = 500 MB, Injection Speed = 400 Gbps, Protocol = TCP/IP.

---

## Step 2: Compare TCP/IP vs RDMA

1. Set Gradient Size = 500 MB, Speed = 400 Gbps, Nodes = 8.

| Protocol | Sync Latency (ms) | Kernel Overhead (ms) | Compute Efficiency (%) |
| -------- | ------------------ | -------------------- | ---------------------- |
| TCP/IP   |                    |                      |                        |
| RDMA     |                    |                      |                        |

---

## Step 3: Study Gradient Tensor Size Effect

1. Set Protocol = RDMA, Speed = 400 Gbps, Nodes = 16.

| Gradient Size (MB) | Sync Latency (ms) | Efficiency (%) |
| ------------------- | ------------------ | -------------- |
| 50                  |                    |                |
| 200                 |                    |                |
| 500                 |                    |                |
| 1000                |                    |                |
| 2000                |                    |                |

---

## Step 4: Study Network Speed Effect

1. Set Gradient = 500 MB, Protocol = RDMA, Nodes = 16.

| Injection Speed (Gbps) | Sync Latency (ms) |
| ----------------------- | ------------------ |
| 100                     |                    |
| 200                     |                    |
| 400                     |                    |
| 800                     |                    |

---

## Step 5: Simulate Straggler Node

1. Configure a balanced cluster.
2. Activate the **Straggler Node** scenario.
3. Observe: How one slow node delays all others, total sync time increase.

---

## Step 6: Verify the Formula

$$
T_{sync} = \frac{2(N-1)}{N} \times \frac{S_g}{B_{inj}}
$$

1. Calculate manually and compare with simulation.

---

# Observation

Record all values. Note the dramatic difference between TCP/IP and RDMA at high node counts.

---

# Result

The effects of gradient tensor size, network injection speed, and transfer protocol on all-reduce synchronization latency and cluster compute efficiency were successfully studied. RDMA demonstrated significantly lower synchronization overhead compared to TCP/IP.
